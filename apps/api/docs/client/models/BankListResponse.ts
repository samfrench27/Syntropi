/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Bank } from './Bank';
import type { Pagination } from './Pagination';
export type BankListResponse = {
    success?: boolean;
    data?: {
        banks?: Array<Bank>;
        pagination?: Pagination;
    };
};

