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
  // Control attributes
  A02: string;
  A03: string;
  A04: string;
  A07: string;
  A21: string;

  // Sensor attributes
  S07: string;
  S14: string;

  // Allow additional attributes for capability discovery
  [key: string]: string;
}
