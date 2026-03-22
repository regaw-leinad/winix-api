export enum Attribute {
  // Control attributes
  Power = 'A02',
  Mode = 'A03',
  Airflow = 'A04',
  Plasmawave = 'A07',
  ChildLock = 'A08',
  PollutionLamp = 'A09',
  UV = 'A10',
  FilterDoor = 'A11',
  FilterDetect = 'A12',
  Timer = 'A15',
  Brightness = 'A16',
  FilterHours = 'A21',

  // Sensor attributes
  PM25 = 'S04',
  AirQuality = 'S07',
  AirQValue = 'S08',
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

export enum ChildLock {
  Off = '0',
  On = '1'
}

export enum PollutionLamp {
  Off = '0',
  On = '1'
}

export enum UV {
  Off = '0',
  On = '1'
}

export enum Brightness {
  Off = '0',
  Low = '30',
  Medium = '70',
  High = '100'
}

export enum Timer {
  Off = '0',
  OneHour = '1',
  TwoHours = '2',
  FourHours = '4',
  EightHours = '8',
  TwelveHours = '12'
}

export interface DeviceStatus {
  // Common attributes (all models)
  power: Power;
  mode: Mode;
  airflow: Airflow;
  filterHours: number;

  // Optional attributes (model-dependent)
  airQuality?: AirQuality;
  plasmawave?: Plasmawave;
  ambientLight?: number;
  childLock?: ChildLock;
  pollutionLamp?: PollutionLamp;
  uv?: UV;
  brightness?: Brightness;
  timer?: Timer;
  filterDoor?: string;
  filterDetect?: string;
  pm25?: number;
  airQValue?: number;
}

export class DeviceCapabilities {

  readonly availableAttributes: Set<string>;

  constructor(
    readonly modelName: string,
    availableAttributes: string[],
  ) {
    this.availableAttributes = new Set(availableAttributes);
  }

  private has(attribute: Attribute): boolean {
    return this.availableAttributes.has(attribute);
  }

  get hasPlasmawave(): boolean {
    return this.has(Attribute.Plasmawave);
  }

  get hasChildLock(): boolean {
    return this.has(Attribute.ChildLock);
  }

  get hasPollutionLamp(): boolean {
    return this.has(Attribute.PollutionLamp);
  }

  get hasUV(): boolean {
    return this.has(Attribute.UV);
  }

  get hasBrightness(): boolean {
    return this.has(Attribute.Brightness);
  }

  get hasTimer(): boolean {
    return this.has(Attribute.Timer);
  }

  get hasFilterDoor(): boolean {
    return this.has(Attribute.FilterDoor);
  }

  get hasFilterDetect(): boolean {
    return this.has(Attribute.FilterDetect);
  }

  get hasPM25(): boolean {
    return this.has(Attribute.PM25);
  }

  get hasAirQValue(): boolean {
    return this.has(Attribute.AirQValue);
  }

  get hasAmbientLight(): boolean {
    return this.has(Attribute.AmbientLight);
  }
}
