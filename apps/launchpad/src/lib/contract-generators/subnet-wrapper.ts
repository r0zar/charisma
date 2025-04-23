"use server";
import fs from 'fs';
import path from 'path';
import Mustache from 'mustache';

export interface SubnetWrapperParams {
    tokenContract: string;
    tokenName: string;
    blazeContract: string;
    enableBearer?: boolean;
    enableLTE?: boolean;
}

export async function generateSubnetWrapper(params: SubnetWrapperParams) {
    const templatePath = path.join(process.cwd(), '..', '..', 'apps', 'blaze-signer', 'src', 'contracts', 'subnet-wrapper.template.clar');
    const template = fs.readFileSync(templatePath, 'utf8');

    const rendered = Mustache.render(template, {
        TOKEN_CONTRACT: params.tokenContract,
        TOKEN_NAME: params.tokenName,
        BLAZE_CONTRACT: params.blazeContract,
        ENABLE_BEARER: params.enableBearer ?? true,
        ENABLE_LTE: params.enableLTE ?? false,
    });

    const filename = `${params.tokenName.replace(/\s+/g, '-').toLowerCase()}-wrapper.clar`;
    return { code: rendered, filename };
} 