"use server";
import Mustache from 'mustache';

export interface SublinkParams {
    tokenName: string;
    subnetContract: string;
    metadataUri: string;
}

export async function generateSublink(params: SublinkParams) {
    const templateUrl = `https://launchpad.charisma.rocks/clarity-templates/sublink.template.clar`;

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