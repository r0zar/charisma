export interface Attribute {
    display_type?: 'string' | 'number' | 'date' | 'boolean';
    trait_type: string;
    value: string;
}

export interface SIP16 {
    sip: '16';
    name: string;
    description?: string | null;
    image?: string | null;
    attributes?: Attribute[] | null;
    properties?: Record<string, any> | null;
}

class Vault {
    name: string;
    description: string;
    image: string;
    attributes: Attribute[];
    properties: Record<string, any>;

    constructor(metadata: SIP16) {
        this.name = metadata.name;
        this.description = metadata.description ?? '';
        this.image = metadata.image ?? '';
        this.attributes = metadata.attributes ?? [];
        this.properties = metadata.properties ?? {};
    }

}

export { Vault };
