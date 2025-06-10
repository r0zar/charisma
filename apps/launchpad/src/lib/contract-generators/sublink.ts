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
    const templatePath = path.join(process.cwd(), 'templates', 'sublink.template.clar');
    const template = fs.readFileSync(templatePath, 'utf8');

    const rendered = Mustache.render(template, {
        TOKEN_NAME: params.tokenName,
        SUBNET_CONTRACT: params.subnetContract,
        METADATA_URI: params.metadataUri,
    });

    const filename = `${params.tokenName.replace(/\s+/g, '-').toLowerCase()}-sublink.clar`;
    return { code: rendered, filename };
} 