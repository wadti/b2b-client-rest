# FRQ NM B2B client with REST endpoint 

This container does two things:

* Runns as a server with REST endpoint to query flight data from NM 

* Periodically downlaods flight data for a specified airport and stores it to a postgres db

## Configuration

### postgres

To set up the database and a pgadmin, run 

```shell
$ docker compose up 
```

with a docker-compose..yml containing:

```shell
version: '3'
services:
  postgres:
    container_name: pg
    image: postgres:9.6
    hostname: postgres
    ports:
      - "5432:5342"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: flightsByAerodrome
    volumes:
       - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    
  pgAdmin:
    container_name: pgadmin
    image: dpage/pgadmin4:latest
    ports:
      - "8080:80"
    environment:
      PGADMIN_DEFAULT_EMAIL: john@doe.com
      PGADMIN_DEFAULT_PASSWORD: TopSecret
      PGADMIN_CONFIG_ENHANCED_COOKIE_PROTECTION: 'True'
      PGADMIN_CONFIG_CONSOLE_LOG_LEVEL: 10
        
volumes:
  postgres-data:
```

This will pull and start a postgres database and pgadmin container, allready configured for the use for this container.

To find out the IP address of the database container run:

```shell
$ docker inspect pg | grep IPAddress
```

You'll need this to set up the address in the .env file.

### .env 

The container needs to be started up with a .env file.
This file must contain:

```shell
B2B_FLAVOUR=PREOPS
B2B_CERT_FORMAT=pfx
B2B_CERT=/cert/<YourCert>.p12
B2B_CERT_PASSPHRASE=<YourPassPhrase>
B2B_AERODROME=<ICAO code of airport>
B2B_REST_PORT=<restPort>
PGUSER=<pgUser>
PGHOST=172.xxx.xxx.xxx
PGPASSWORD=<pgPw>
PGDATABASE=<pgDB>
PGPORT=<pgPort>
```

The B2B_FLAVOUR sets if you want to use PREOPS or OPS data. All env vars wit CERT defines the authentification. 
B2B_AERODROME sets the aerodrome, from which you want to download the flight data periodically. B2B_REST_PORT sets the port where you can qurey the flight data for a given aerodrome via REST (default: 3000). PG_USER, PG_PASSWORD, PG_DATABASE and PG_PORT are set automatically set via docker-compose.yml. If you need to do any changes, make sure, to also update these env vars there! 

### Authentication 

You'll need to have a valid NMB2B certificate and, to run this container.
The passphrase needs to be provided in the .env file (B2B_CERT_PASSPHRASE).

The certificate is passed to the container via a docker volume. To set up a docker volume, run:

```shell
$ docker volume create cert
$ docker volume inspect cert
```

Copy your certificate to the "Mountingpoint" you see after inspect.

## Run the container

To run the container, start it via docker run:

```shell
$ docker run --mount source=cert,destination=/cert --net=host --env-file=../.env wudti/b2b-client-rest:0.1
```

The container is now up and running and should look something like this:

```shell
yarn run v1.22.18
$ node --openssl-legacy-provider src/index.js
NMB2B client running on port 3000
Started: Thu Apr 14 2022 11:27:52 GMT+0000 (Coordinated Universal Time)
Auto downloader running for LSZH
---------------------------------
```

### REST

To query flightsByAerodrome, you'll need to pass three arguments:

* aerodrome: ICAO code of aerodrome (four letters)
* from: timestamp that has to match this format: 2022-04-13T14:46:09.000Z
* to: timestamp that has to match this format: 2022-04-13T14:46:09.000Z

from and to specifiy the time window you want to qurey.

On the host system, you can test the REST endpoint by opening you browser and enter a qurey that should look something like this:

http://localhost:3000/LSZH/2022-04-13T14:46:09.000Z/2022-04-13T16:46:09.000Z

## Versions

### 0.1
Flight data requested with REST is returned as JSON, no input validation

### 0.2
Flight data requested with REST is now returned as XML, no input validation


### 0.3
Added REGEX input validation for ICAO code and timestamps in REST request

### 0.4
Added flag to toggle auto download of flight data, `AUTO_DOWNL=[0|1]` can now be set in .env (Default = 0).



