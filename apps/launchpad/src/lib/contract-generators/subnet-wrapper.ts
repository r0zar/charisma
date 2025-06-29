"use server";
import Mustache from 'mustache';

export interface SubnetWrapperParams {
    tokenContract: string;
    tokenName: string;
    blazeContract: string;
    enableBearer?: boolean;
    enableLTE?: boolean;
}

export async function generateSubnetWrapper(params: SubnetWrapperParams) {
    const templateUrl = `https://launchpad.charisma.rocks/clarity-templates/subnet-wrapper.template.clar`;

    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    const template = await response.text();

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