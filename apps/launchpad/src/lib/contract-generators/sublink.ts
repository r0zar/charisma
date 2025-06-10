"use server";
import fs from 'fs';
import path from 'path';
import Mustache from 'mustache';

export interface SublinkParams {
    tokenName: string;
    subnetContract: string;
    metadataUri: string;
}

export async function generateSublink(params: SublinkParams) {
    // Adjust the base URL as needed for your environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3007';
    const templateUrl = `${baseUrl}/templates/sublink.template.clar`;

    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    const template = await response.text();

    const rendered = Mustache.render(template, {
        TOKEN_NAME: params.tokenName,
        SUBNET_CONTRACT: params.subnetContract,
        METADATA_URI: params.metadataUri,
    });

    const filename = `${params.tokenName.replace(/\s+/g, '-').toLowerCase()}-sublink.clar`;
    return { code: rendered, filename };
} 