import { Gender } from "~gen/prisma/enums";

export interface GenderizeResponse {
  count: number;
  name: string;
  gender: Gender | null;
  probability: number;
}
export interface AgifyResponse {
  count: number;
  name: string;
  age: number;
}
export interface NationalizeResponse {
  count: number;
  name: string;
  country: NationalizeCountryData[]
}
export interface NationalizeCountryData {
  country_id: string;
  probability: number;
}
export interface RestCountriesData {
  name: {
    common: string,
  }
  cca2: string
}

export interface ClassifyResponse {
  name: string;
  gender: Gender;
  probability: number;
  sample_size: number;
  is_confident: boolean;
  processed_at: string;
}