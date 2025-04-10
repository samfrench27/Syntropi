/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BankListResponse } from '../models/BankListResponse';
import type { BankResponse } from '../models/BankResponse';
import type { ProvidersResponse } from '../models/ProvidersResponse';
import type { SyncResponse } from '../models/SyncResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DefaultService {
    /**
     * List all banks
     * Returns a list of banks with optional filtering by country, provider, payment method, and search term.
     * Results are paginated.
     *
     * @param country Filter by ISO 3166-1 alpha-2 country code
     * @param provider Filter by banking provider
     * @param paymentMethod Filter by supported payment method
     * @param search Search term to filter bank names
     * @param page Page number for pagination
     * @param limit Number of results per page
     * @returns BankListResponse List of banks
     * @throws ApiError
     */
    public static listBanks(
        country?: string,
        provider?: string,
        paymentMethod?: string,
        search?: string,
        page: number = 1,
        limit: number = 100,
    ): CancelablePromise<BankListResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/banks',
            query: {
                'country': country,
                'provider': provider,
                'paymentMethod': paymentMethod,
                'search': search,
                'page': page,
                'limit': limit,
            },
            errors: {
                401: `Authentication error`,
                500: `Server error`,
            },
        });
    }
    /**
     * Get supported banking providers
     * Returns a list of all supported banking providers
     * @returns ProvidersResponse List of providers
     * @throws ApiError
     */
    public static listProviders(): CancelablePromise<ProvidersResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/banks/providers',
            errors: {
                401: `Authentication error`,
            },
        });
    }
    /**
     * Get bank details
     * Returns detailed information about a specific bank
     * @param id Bank ID
     * @returns BankResponse Bank details
     * @throws ApiError
     */
    public static getBankById(
        id: string,
    ): CancelablePromise<BankResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/banks/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `Authentication error`,
                404: `Bank not found`,
            },
        });
    }
    /**
     * Sync banks from providers
     * Admin-only endpoint to synchronize bank information from providers.
     * Optional query parameter to specify which provider to sync.
     *
     * @param provider Specific provider to sync (omit to sync all)
     * @returns SyncResponse Sync results
     * @throws ApiError
     */
    public static syncBanks(
        provider?: string,
    ): CancelablePromise<SyncResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/banks/sync',
            query: {
                'provider': provider,
            },
            errors: {
                401: `Authentication error`,
                403: `Authorization error`,
            },
        });
    }
}
