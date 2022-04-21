// NMB2B Client with REST endpoint 
// Same functionality as b2b-client-aerodrome-docker
// + query to NM can be triggered by a request
// Params: AERODROME, Time from, Time to
// Restrictions: No flights from the past on request 
// -----------------------------------------------------
// Request restrictions by NM (FlightListByAerodromeRequest):
// (from 01_Essentials.pdf, p. 70)
// Overbooking Request Count: 600
// Max Request Count: 720
// Time Window(in s): 600

// To run script as container: package.json --> add "--openssl-legacy-provider" after "node" (start)

// SGabler, 21.04.2022

var express = require("express");
require('dotenv/config');
const { makeFlightClient } = require('b2b-client-frq');
const { fromEnv } = require('b2b-client-frq/dist/security');
const moment = require('moment');
const security = fromEnv();
const fs = require('fs');
const { Pool } = require('pg');
const cron = require('node-cron');
const { raw } = require("express");
const X2JS = require("x2js");
require('x2js');

const aerodromeEnv = process.env.B2B_AERODROME;
const PORT = process.env.B2B_REST_PORT;

var app = express(); app.listen(PORT, () => {
    console.log("NMB2B client running on port 3000");
    console.log('Started: ' + moment().utc().toDate());
    console.log("Auto downloader running for " + aerodromeEnv);
    console.log("---------------------------------");
    //console.log(moment.utc().toDate())
})
app.get('/:aerodrome/:from/:to', async function (req, res) {

    var aerodrome = req.params.aerodrome;
    var from = req.params.from;
    var to = req.params.to;
    
    console.log('REST REQUEST:');
    console.log('aerodrome: "', aerodrome, '"');
    console.log('wef: "', from, '"');
    console.log('unt: "', to, '"');
    console.log("---------------------------------");

    // Check input with regex

    let regexAerodrome = new RegExp('^[A-Z]{4}$');
    let regexDateTime = new RegExp('^(20)\\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]).\\d{3}Z');

    if(regexAerodrome.test(aerodrome) == false){
        res.send("ERROR: Aerodrome string does not match ICAO code!");
        console.log("ERROR: Aerodrome string does not match ICAO code!");
        console.log("---------------------------------");
        return;
    }
    if(regexDateTime.test(from) == false){
        res.send("ERROR: wef is not valid!");
        console.log("ERROR: wef is not valid!");
        console.log("---------------------------------");
        return;
    }
    if(regexDateTime.test(to) == false){
        res.send("ERROR: unt is not valid!");
        console.log("ERROR: unt is not valid!");
        console.log("---------------------------------");
        return;
    }

    //Test: http://localhost:3000/LSZH/2022-04-21T09:46:09.000Z/2022-04-21T15:46:09.000Z

    async function init() {
        const start = process.hrtime();
        const Flight = await makeFlightClient({
            security,
            flavour: process.env.B2B_FLAVOUR,
            XSD_PATH: process.env.B2B_XSD_PATH || '/tmp/b2b-xsd',
        });
        const [elapsedS, elapsedNs] = process.hrtime(start);

        console.log(
            `REST: SOAP CLIENT initialized in ${(elapsedS + elapsedNs / 1e9).toFixed(3)}s`,
        );

        const res = await Flight.queryFlightsByAerodrome({
            dataset: { type: 'OPERATIONAL' },
            includeProposalFlights: false,
            includeForecastFlights: false,
            trafficType: 'DEMAND',
            trafficWindow: {
                wef: moment(from)
                    .utc()
                    .toDate(),
                unt: moment(to)
                    .utc()
                    .toDate(),
            },
            requestedFlightFields: ['readyEstimatedOffBlockTime',
                'cdmEstimatedOffBlockTime',
                'aircraftType',
                'estimatedTakeOffTime',
                'calculatedTakeOffTime',
                'actualTakeOffTime',
                'taxiTime',
                'estimatedTimeOfArrival',
                'calculatedTimeOfArrival',
                'actualTimeOfArrival',
                'lateFiler',
                'lateUpdater',
                'readyStatus',
                'aircraftOperator',
                'operatingAircraftOperator',
                'slotIssued',
                'exemptedFromRegulations',
                'delay',
                'delayCharacteristics',
                'mostPenalisingRegulation',
                'hasOtherRegulations',
                'regulationLocations',
                'estimatedElapsedTime',
                'departureTolerance',
                'icaoRoute',
                'mostPenalisingRegulationCause',
                'filedRegistrationMark',
                'isProposalFlight',
                'hasBeenForced',
                'ctotLimitReason',
                'slotSwapCounter',
                'aircraftAddress'],
            aerodrome: aerodrome,
            aerodromeRole: 'BOTH',
        });

        const {
            data: { flights },
        } = res;

        let flightData = JSON.stringify(res);
        //fs.writeFileSync('result.json', flightData);
        console.log("REST: SOAP CLIENT returning flight data")
        //return flightData;

        // DOKU: https://www.npmjs.com/package/x2js
        var x2js = new X2JS();
        var xmlAsStr = x2js.js2xml(res);
        //console.log("XML:", xmlAsStr);
        return xmlAsStr;

    }

    try {
        let result = await init();
        res.send(result);
        console.log("REST: Response sent!");
    } catch (e) {
        console.log(e)
        res.sendStatus(500);
        console.log("REST: No response sent!");
    }
});
;;

// Scheduled flight downloader
/*

cron.schedule('6,36 * * * *', () => {
    result = init();

    async function init() {
        const start = process.hrtime();
        const Flight = await makeFlightClient({
            security,
            flavour: process.env.B2B_FLAVOUR,
            XSD_PATH: process.env.B2B_XSD_PATH || '/tmp/b2b-xsd',
        });
        const [elapsedS, elapsedNs] = process.hrtime(start);
        
        console.log("---------------------------------");
        console.log(
            `AUTO: SOAP CLIENT initialized in ${(elapsedS + elapsedNs / 1e9).toFixed(3)}s`,
        );

        const res = await Flight.queryFlightsByAerodrome({
            dataset: { type: 'OPERATIONAL' },
            includeProposalFlights: false,
            includeForecastFlights: false,
            trafficType: 'DEMAND',
            trafficWindow: {
                wef: moment
                    .utc()
                    .toDate(),
                unt: moment
                    .utc()
                    .add(30, 'minutes')
                    .toDate(),
            },
            requestedFlightFields: ['readyEstimatedOffBlockTime',
                'cdmEstimatedOffBlockTime',
                'aircraftType',
                'estimatedTakeOffTime',
                'calculatedTakeOffTime',
                'actualTakeOffTime',
                'taxiTime',
                'estimatedTimeOfArrival',
                'calculatedTimeOfArrival',
                'actualTimeOfArrival',
                'lateFiler',
                'lateUpdater',
                'readyStatus',
                'aircraftOperator',
                'operatingAircraftOperator',
                'slotIssued',
                'exemptedFromRegulations',
                'delay',
                'delayCharacteristics',
                'mostPenalisingRegulation',
                'hasOtherRegulations',
                'regulationLocations',
                'estimatedElapsedTime',
                'departureTolerance',
                'icaoRoute',
                'mostPenalisingRegulationCause',
                'filedRegistrationMark',
                'isProposalFlight',
                'hasBeenForced',
                'ctotLimitReason',
                'slotSwapCounter',
                'aircraftAddress'],
            //requestedFlightFields: 'aircraftType', // WORKS but only with on field
            aerodrome: aerodromeEnv,
            aerodromeRole: 'BOTH',
        });

        const {
            data: { flights },
        } = res;

        //console.log('-------')
        //console.log(flights)

        //Write json
        //let flightData = JSON.stringify(flights);
        //fs.writeFileSync('result.json', flightData);

        let flightData = JSON.stringify(res);
        //fs.writeFileSync('result.json', flightData);
        console.log("AUTO: SOAP Client returning flight data")
        //return flightData;

        // raw response

        const lastRequest = Flight.lastRequest;
        fs.writeFileSync('raw.xml', lastRequest);
        return lastRequest;
    }


    // CONFIG:
    const schemaName = "flightsByAerodrome";

    //QUERYS SCHEMA AND TABLES:
    let createSchemaSql = `CREATE SCHEMA IF NOT EXISTS
                ${schemaName} AUTHORIZATION postgres;`;

    let createMetaTableSql = `CREATE TABLE IF NOT EXISTS ${schemaName}.meta(
                          requestId CHARACTER VARYING(16) NOT NULL,
                          sendTime TIMESTAMP WITH TIME ZONE NOT NULL,
                          requestReceptionTime TIMESTAMP WITH TIME ZONE NOT NULL,
                          status CHARACTER VARYING(16), 
                          effectiveTrafficWindowFrom TIMESTAMP WITH TIME ZONE, 
                          effectiveTrafficWindowTo TIMESTAMP WITH TIME ZONE, 
                          CONSTRAINT meta_pkey PRIMARY KEY (requestId)
                          );`;

    let createFlightsTableSql = `CREATE TABLE IF NOT EXISTS ${schemaName}.flights(
                            requestId character varying(16) NOT NULL,
                            flightId character varying(10)  NOT NULL,
                            aircraftId character varying(8),
                            aerodromeOfDeparture character(4),
                            aerodromeOfDestination character(4),
                            estimatedOffBlockTime timestamp with time zone,
                            estimatedTakeOffTime timestamp with time zone,
                            actualTakeOffTime timestamp with time zone,
                            taxiTime bigint,
                            estimatedTimeOfArrival timestamp with time zone,
                            actualTimeOfArrival timestamp with time zone,
                            aircraftOperator character(3),
                            operatingAircraftOperator character(3),
                            exemptedFromRegulations boolean,
                            mostPenalisingRegulation character varying(16),
                            mostPenalisingRegulationReason character varying(30),
                            mostPenalisingRegulationLocationCategory character varying(30),
                            mostPenalisingRegulationIataDelayCode integer,
                            departureToleranceFrom time without time zone,
                            departureToleranceTo time without time zone,
                            ctotLimitReason character varying(25),
                            slotSwapCounterCurrent integer,
                            slotSwapCounterMax integer,
                            rawJson json,
                            CONSTRAINT flights_pkey PRIMARY KEY (requestId, flightId),
                            CONSTRAINT fk FOREIGN KEY (requestId)
                            REFERENCES ${schemaName}.meta (requestid) MATCH SIMPLE
                            ON UPDATE NO ACTION 
                            ON DELETE NO ACTION
                            )`;


    // TRANSACTION
    // https://node-postgres.com/features/transactions
    const pool = new Pool()
        ; (async () => {
            const start = process.hrtime();
            let soapRes = await result
            let flightData = JSON.parse(soapRes);

            var requestId = flightData.requestId
            var requestReceptionTime = flightData.requestReceptionTime
            var sendTime = flightData.sendTime
            var status = flightData.status
            var effectiveTrafficWindowFrom = flightData.data.effectiveTrafficWindow.wef
            var effectiveTrafficWindowTo = flightData.data.effectiveTrafficWindow.unt

            const [elapsedS, elapsedNs] = process.hrtime(start)


            console.log('AUTO: TRANSACTION started')
            const client = await pool.connect()
            try {
                await client.query('BEGIN')
                // SCHEMA
                const res = await client.query(createSchemaSql)
                // TABLES
                await client.query(createMetaTableSql)
                await client.query(createFlightsTableSql)
                // META
                const insertMetaText = `INSERT INTO ${schemaName}.meta(
                              requestId, 
                              requestReceptionTime, 
                              sendTime, 
                              effectiveTrafficWindowFrom, 
                              effectiveTrafficWindowTo, 
                              status) VALUES($1, $2, $3, $4, $5, $6)`
                const insertMetaValues = [requestId,
                    requestReceptionTime,
                    sendTime,
                    effectiveTrafficWindowFrom,
                    effectiveTrafficWindowTo,
                    status]
                await client.query(insertMetaText, insertMetaValues)
                // FLIGHTS
                for (let i = 0; i < flightData.data.flights.length; i++) {
                    try {
                        var flightId = flightData.data.flights[i].flight.flightId.id;
                    } catch (err) {
                        var flightId = null;
                    }
                    try {
                        var aircraftId = flightData.data.flights[i].flight.flightId.keys.aircraftId;
                    } catch (err) {
                        var aircraftId = null;
                    }
                    try {
                        var aerodromeOfDeparture = flightData.data.flights[i].flight.flightId.keys.aerodromeOfDeparture;
                    } catch (err) {
                        var aerodromeOfDeparture = null;
                    }
                    try {
                        var aerodromeOfDestination = flightData.data.flights[i].flight.flightId.keys.aerodromeOfDestination;
                    } catch (err) {
                        var aerodromeOfDestination = null;
                    }
                    try {
                        var estimatedOffBlockTime = flightData.data.flights[i].flight.flightId.keys.estimatedOffBlockTime;
                    } catch (err) {
                        var estimatedOffBlockTime = null;
                    }
                    try {
                        var estimatedTakeOffTime = flightData.data.flights[i].flight.estimatedTakeOffTime;
                    } catch (err) {
                        var estimatedTakeOffTime = null;
                    }
                    try {
                        var actualTakeOffTime = flightData.data.flights[i].flight.actualTakeOffTime;
                    } catch (err) {
                        var actualTakeOffTime = null;
                    }
                    try {
                        var taxiTime = flightData.data.flights[i].flight.taxiTime;
                    } catch (err) {
                        var taxiTime = null;
                    }
                    try {
                        var estimatedTimeOfArrival = flightData.data.flights[i].flight.estimatedTimeOfArrival;
                    } catch (err) {
                        var estimatedTimeOfArrival = null;
                    }
                    try {
                        var actualTimeOfArrival = flightData.data.flights[i].flight.actualTimeOfArrival;
                    } catch (err) {
                        var actualTimeOfArrival = null;
                    }
                    try {
                        var aircraftOperator = flightData.data.flights[i].flight.aircraftOperator;
                    } catch (err) {
                        var aircraftOperator = null;
                    }
                    try {
                        var operatingAircraftOperator = flightData.data.flights[i].flight.operatingAircraftOperator;
                    } catch (err) {
                        var operatingAircraftOperator = null;
                    }
                    try {
                        var exemptedFromRegulations = flightData.data.flights[i].flight.exemptedFromRegulations;
                    } catch (err) {
                        var exemptedFromRegulations = null;
                    }
                    try {
                        var mostPenalisingRegulation = flightData.data.flights[i].flight.mostPenalisingRegulation;
                    } catch (err) {
                        var mostPenalisingRegulation = null;
                    }
                    try {
                        var mostPenalisingRegulationReason = flightData.data.flights[i].flight.mostPenalisingRegulationCause.reason;
                    } catch (err) {
                        var mostPenalisingRegulationReason = null;
                    }
                    try {
                        var mostPenalisingRegulationLocationCategory = flightData.data.flights[i].flight.mostPenalisingRegulationCause.locationCategory;
                    } catch (err) {
                        var mostPenalisingRegulationLocationCategory = null;
                    }
                    try {
                        var mostPenalisingRegulationIataDelayCode = flightData.data.flights[i].flight.mostPenalisingRegulationCause.iataDelayCode;
                    } catch (err) {
                        var mostPenalisingRegulationIataDelayCode = null;
                    }
                    try {
                        var departureToleranceFrom = flightData.data.flights[i].flight.departureTolerance.toleranceWindow.wef;
                    } catch (err) {
                        var departureToleranceFrom = null;
                    }
                    try {
                        var departureToleranceTo = flightData.data.flights[i].flight.departureTolerance.toleranceWindow.unt;
                    } catch (err) {
                        var departureToleranceTo = null;
                    }
                    try {
                        var ctotLimitReason = flightData.data.flights[i].flight.ctotLimitReason;
                    } catch (err) {
                        var ctotLimitReason = null;
                    }
                    try {
                        var slotSwapCounterCurrent = flightData.data.flights[i].flight.slotSwapCounter.currentCounter;
                    } catch (err) {
                        var slotSwapCounterCurrent = null;
                    }
                    try {
                        var slotSwapCounterMax = flightData.data.flights[i].flight.slotSwapCounter.maxLimit;
                    } catch (err) {
                        var slotSwapCounterMax = null;
                    }
                    try {
                        var rawJson = flightData.data.flights[i];
                    } catch (err) {
                        var rawJson = null;
                    }

                    const insertFlightText = `INSERT INTO ${schemaName}.flights(requestId, flightId, aircraftId, aerodromeOfDeparture, aerodromeOfDestination, 
          estimatedOffBlockTime, estimatedTakeOffTime, actualTakeOffTime, taxiTime, estimatedTimeOfArrival, actualTimeOfArrival, 
          aircraftOperator, operatingAircraftOperator, exemptedFromRegulations, mostPenalisingRegulation, mostPenalisingRegulationReason, 
          mostPenalisingRegulationLocationCategory, mostPenalisingRegulationIataDelayCode, departureToleranceFrom, departureToleranceTo, 
          ctotLimitReason, slotSwapCounterCurrent, slotSwapCounterMax, rawJson) 
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`

                    const insertFlightValues = [requestId, flightId, aircraftId, aerodromeOfDeparture, aerodromeOfDestination,
                        estimatedOffBlockTime, estimatedTakeOffTime, actualTakeOffTime, taxiTime, estimatedTimeOfArrival, actualTimeOfArrival,
                        aircraftOperator, operatingAircraftOperator, exemptedFromRegulations, mostPenalisingRegulation, mostPenalisingRegulationReason,
                        mostPenalisingRegulationLocationCategory, mostPenalisingRegulationIataDelayCode, departureToleranceFrom, departureToleranceTo,
                        ctotLimitReason, slotSwapCounterCurrent, slotSwapCounterMax, rawJson]

                    await client.query(insertFlightText, insertFlightValues)
                }
                await client.query('COMMIT')
            } catch (e) {
                await client.query('ROLLBACK')
                console.log("AUTO: TRANSACTION failed, ROLLBACK")
                throw e
            } finally {
                client.release()
                pool.end()
                console.log(`AUTO: TRANSACTION finished in ${(elapsedS + elapsedNs / 1e9).toFixed(3)}s, DB client released`)
            }
        })().catch(e => console.error(e.stack))
});

*/
