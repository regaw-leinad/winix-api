# winix-api

Winix device API client library in Typescript

## Usage

### Setup

```typescript
// Assume this is defined throughout the examples
const deviceId = 'ABCDEF012345_abcde01234';
```

### Get and set the Power state

```typescript
const power: Power = await WinixAPI.getPower(deviceId);
console.log('off?:', power === Power.Off);

// Set power on
await WinixAPI.setPower(deviceId, Power.On);
```

### Get and set the Mode

```typescript
const mode: Mode = await WinixAPI.getMode(deviceId);
console.log('manual?:', mode === Mode.Manual);

// Set to auto
await WinixAPI.setMode(deviceId, Mode.Auto);
```

### Get and set the Airflow speed

```typescript
const airflow: Airflow = await WinixAPI.getAirflow(deviceId);
console.log('turbo?:', mode === Mode.Turbo);

// Set to low
await WinixAPI.setAirflow(deviceId, Airflow.Low);
```

### Get the Air Quality

```typescript
const airQuality: AirQuality = await WinixAPI.getAirQuality(deviceId);
console.log('quality:', airQuality);
```

### Get and set the Plasmawave state

```typescript
const plasma: Plasmawave = await WinixAPI.getPlasmawave(deviceId);
console.log('plasmawave on?:', plasma === Plasmawave.On);

// Set to off
await WinixAPI.setPlasmawave(deviceId, Plasmawave.Off);
```
