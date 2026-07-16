import { EleventyScope, EleventySuppliedData } from "11ty.ts";

export interface CustomEleventySuppliedData extends EleventySuppliedData {
  data: Record<string, unknown>;
}

export interface CustomEleventyScope extends EleventyScope {
  page: CustomEleventySuppliedData;
}
