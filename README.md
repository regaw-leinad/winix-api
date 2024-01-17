# winix-api

[![npm](https://img.shields.io/npm/dt/winix-api)](https://www.npmjs.com/package/winix-api)

This library provides a TypeScript client for interacting with Winix devices. It includes classes for authenticating
with the Winix API (`WinixAuth`), managing a user account (`WinixAccount`), as well as interacting with Winix devices
(`WinixAPI`).

## Installation

This library is a Node.js module. You can install it using npm:

```bash
npm install winix-api
```

or yarn:

```bash
yarn add winix-api
```

## Usage

### Authentication

The `WinixAuth` class is used for authenticating with the Winix API. You can use it to log in with a username and
password, or to refresh an existing session.

```typescript
import { WinixAuth, WinixAuthResponse } from 'winix-api';

// Log in with a username and password
const auth: WinixAuthResponse = await WinixAuth.login('<username>', '<password>');

// Refresh an existing session
const refreshedAuth: WinixAuthResponse = await WinixAuth.refresh('<refreshToken>', '<userId>');
```

### Managing a User Account

The `WinixAccount` class is used for managing a user account. You can use it to get a list of devices associated with
the account.

```typescript
import { WinixAccount, WinixExistingAuth } from 'winix-api';

// Create a WinixAccount from credentials
const account: WinixAccount = await WinixAccount.fromCredentials('<username>', '<password>');

// Create a WinixAccount from existing auth credentials
const existingAuth: WinixExistingAuth = {
  username: '<username>',
  userId: '<userId>',
  refreshToken: '<refreshToken>',
};
const accountFromExistingAuth: WinixAccount = await WinixAccount.fromExistingAuth(existingAuth);

// Get a list of devices associated with the account
const devices = await account.getDevices();
```

### Interacting with a Device

```typescript
import { Airflow, AirQuality, Mode, Plasmawave, Power, WinixAPI } from 'winix-api'

// Assume this is defined throughout the examples
const deviceId = 'ABCDEF012345_abcde01234';
```

#### Get and set the Power state

```typescript
const power: Power = await WinixAPI.getPower(deviceId);
console.log('off?:', power === Power.Off);

// Set power on
await WinixAPI.setPower(deviceId, Power.On);
```

#### Get and set the Mode

```typescript
const mode: Mode = await WinixAPI.getMode(deviceId);
console.log('manual?:', mode === Mode.Manual);

// Set to auto
await WinixAPI.setMode(deviceId, Mode.Auto);
```

#### Get and set the Airflow speed

```typescript
const airflow: Airflow = await WinixAPI.getAirflow(deviceId);
console.log('turbo?:', mode === Mode.Turbo);

// Set to low
await WinixAPI.setAirflow(deviceId, Airflow.Low);
```

#### Get the Air Quality

```typescript
const airQuality: AirQuality = await WinixAPI.getAirQuality(deviceId);
console.log('quality:', airQuality);
```

#### Get and set the Plasmawave state

```typescript
const plasma: Plasmawave = await WinixAPI.getPlasmawave(deviceId);
console.log('plasmawave on?:', plasma === Plasmawave.On);

// Set to off
await WinixAPI.setPlasmawave(deviceId, Plasmawave.Off);
```

#### Get the Ambient Light

```typescript
const ambientLight: number = await WinixAPI.getAmbientLight(deviceId);
console.log('ambientLight:', ambientLight);
```
