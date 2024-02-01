export interface DeviceApiResponse<T> {
  headers: Headers;
  body: T;
}

export interface Headers {
  resultCode: string;
  resultMessage: string;
}

export type SetAttributeResponse = DeviceApiResponse<void>;
export type StatusResponse = DeviceApiResponse<StatusBody>;

export interface StatusBody {
  data: StatusData[];
}

export interface StatusData {
  attributes: StatusAttributes;
}

export interface StatusAttributes {
  // Power
  A02: string;
  // Mode
  A03: string;
  // Airflow
  A04: string;
  // Plasmawave
  A07: string;
  // Filter Hours
  A21: string;
  // Air Quality
  S07: string;
  // Ambient Light
  S14: string;
}
