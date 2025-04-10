/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SyncResponse = {
    success?: boolean;
    message?: string;
    data?: Record<string, {
        created?: number;
        updated?: number;
        skipped?: number;
        total?: number;
    }>;
};

