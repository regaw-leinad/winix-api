export enum Attribute {
  Power = 'A02',
  Mode = 'A03',
  Airflow = 'A04',
  Plasmawave = 'A07',
  FilterHours = 'A21',
  AirQuality = 'S07',
  AmbientLight = 'S14'
}

export type AttributeValue = string;

export enum Power {
  Off = '0',
  On = '1'
}

export enum Mode {
  Auto = '01',
  Manual = '02'
}

export enum Airflow {
  Low = '01',
  Medium = '02',
  High = '03',
  Turbo = '05',
  Sleep = '06'
}

export enum AirQuality {
  Good = '01',
  Fair = '02',
  Poor = '03'
}

export enum Plasmawave {
  Off = '0',
  On = '1'
}

export interface DeviceStatus {
  power: Power;
  mode: Mode;
  airflow: Airflow;
  airQuality: AirQuality;
  plasmawave: Plasmawave;
  ambientLight: number;
  filterHours: number;
}
