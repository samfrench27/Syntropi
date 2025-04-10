/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Bank = {
    id?: string;
    name?: string;
    /**
     * ISO 3166-1 alpha-2 country code
     */
    country?: string;
    logoUrl?: string;
    supportedPaymentMethods?: Array<string>;
    providerMappings?: Record<string, {
        providerId?: string;
        supportedPaymentMethods?: Array<string>;
        lastUpdated?: string;
        active?: boolean;
    }>;
};

