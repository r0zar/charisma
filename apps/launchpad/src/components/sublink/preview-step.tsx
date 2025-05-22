import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Globe, ExternalLink, Sparkles, Info } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generatePixelArtDataUri } from "../../lib/utils/image-utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// shorten the address but show the full contract name
function shortenAddress(address: string) {
    const contractName = address.split(".")[0];
    return contractName.slice(0, 6) + "..." + contractName.slice(-4) + '.' + address.split(".")[1]
}

interface PreviewStepProps {
    state: {
        tokenContract: string;
        subnetContract: string;
        metadataUri: string;
    };
    contractCode: string;
    tokenName: string;
    tokenSymbol: string;
    contractName: string;
    onPrevious: () => void;
    onDeploy: () => void;
    isDeploying: boolean;
    onMetadataUriChange?: (uri: string) => void;
}

const PreviewStep = ({
    state,
    contractCode,
    tokenName,
    tokenSymbol,
    contractName,
    onPrevious,
    onDeploy,
    isDeploying,
    onMetadataUriChange
}: PreviewStepProps) => {
    const [metadataUri, setMetadataUri] = useState(state.metadataUri || "");
    const [metaPreview, setMetaPreview] = useState<{ name?: string; image?: string } | null>(null);
    const [metaLoading, setMetaLoading] = useState(false);
    const [metaError, setMetaError] = useState<string | null>(null);

    useEffect(() => {
        if (!metadataUri) {
            setMetaPreview(null);
            setMetaError(null);
            return;
        }
        setMetaLoading(true);
        setMetaError(null);
        fetch(metadataUri)
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to fetch metadata");
                const data = await res.json();
                if (!data.name || !data.image) throw new Error("Metadata must include 'name' and 'image'");
                setMetaPreview({ name: data.name, image: data.image });
            })
            .catch((err) => {
                setMetaPreview(null);
                setMetaError(err.message || "Failed to load metadata");
            })
            .finally(() => setMetaLoading(false));
    }, [metadataUri]);

    const handleUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMetadataUri(e.target.value);
        if (onMetadataUriChange) onMetadataUriChange(e.target.value);
    };

    const handleGenerateDefaultMetadata = () => {
        if (!onMetadataUriChange || !tokenSymbol) {
            // console.warn("Cannot generate default metadata: onMetadataUriChange or tokenSymbol is missing.");
            return;
        }

        const defaultName = `${tokenSymbol}-sublink-meta`; // Simple name
        const defaultImage = generatePixelArtDataUri(); // Generates 4x4 by default

        const metadataJson = JSON.stringify({
            name: defaultName,
            image: defaultImage,
            description: `Sublink metadata for ${tokenSymbol}`
        });

        const base64EncodedJson = Buffer.from(metadataJson).toString('base64');
        const dataUri = `data:application/json;base64,${base64EncodedJson}`;

        onMetadataUriChange(dataUri);
    };

    return (
        <div className="space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Preview Generated Contract</h2>
                <p className="text-muted-foreground">
                    Review the Clarity contract before deployment
                </p>
            </div>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Globe className="mr-2 h-5 w-5 text-primary" />
                        Metadata Preview
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        {onMetadataUriChange && (
                            <div className="space-y-2 pt-4 border-t mt-4">
                                <Label htmlFor="metadataUri" className="flex items-center">
                                    Metadata URI (Optional)
                                    <TooltipProvider>
                                        <Tooltip delayDuration={100}>
                                            <TooltipTrigger className="ml-1.5 cursor-help">
                                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs p-3">
                                                <p className="text-xs">
                                                    Provide a URL to a JSON file containing your sublink's metadata (name, image, description).
                                                    Alternatively, generate a default on-chain metadata URI.
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="metadataUri"
                                        type="text"
                                        placeholder="https://.../metadata.json or data:..."
                                        value={state.metadataUri}
                                        onChange={(e) => onMetadataUriChange(e.target.value)}
                                        className="flex-grow"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleGenerateDefaultMetadata}
                                        disabled={!tokenSymbol} // Disable if no tokenSymbol to derive name
                                        className="shrink-0"
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate Default
                                    </Button>
                                </div>
                                {state.metadataUri.startsWith('data:application/json;base64,') && (
                                    <p className="text-xs text-muted-foreground pt-1">
                                        Using generated on-chain metadata. Length: {state.metadataUri.length} characters.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    {metaLoading && <div className="text-sm text-muted-foreground">Loading metadata...</div>}
                    {metaError && <div className="text-sm text-destructive">{metaError}</div>}
                    {metaPreview && (
                        <div className="flex items-center gap-4 mt-4">
                            <div className="w-16 h-16 rounded bg-muted flex items-center justify-center overflow-hidden">
                                {metaPreview.image ? (
                                    <img
                                        src={metaPreview.image}
                                        alt={metaPreview.name || "Preview"}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-xl font-bold text-primary/60">?</div>
                                )}
                            </div>
                            <div>
                                <div className="font-medium text-lg">{metaPreview.name}</div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Globe className="mr-2 h-5 w-5 text-primary" />
                        Contract Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="bg-muted rounded-md p-4">
                            <div className="grid grid-cols-1 md:grid-cols-1 gap-3 text-sm">
                                <div>
                                    <span className="font-semibold">Token:</span> {tokenName} ({tokenSymbol})
                                </div>
                                <div className="flex items-center">
                                    <span className="font-semibold">Token Contract:</span>
                                    <div className="flex items-center">
                                        <Link href={`https://explorer.hiro.so/txid/${state.tokenContract}`} target="_blank" rel="noopener noreferrer">
                                            <div className="flex items-center">
                                                <span className="ml-1">{shortenAddress(state.tokenContract)}</span>
                                                <ExternalLink className="ml-1 h-3 w-3" />
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <span className="font-semibold">Subnet Contract:</span>
                                    <div className="flex items-center">
                                        <Link href={`https://explorer.hiro.so/txid/${state.subnetContract}`} target="_blank" rel="noopener noreferrer">
                                            <div className="flex items-center">
                                                <span className="ml-1">{shortenAddress(state.subnetContract)}</span>
                                                <ExternalLink className="ml-1 h-3 w-3" />
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                                <div>
                                    <span className="font-semibold">Contract name:</span> {contractName}
                                </div>
                            </div>
                        </div>
                        <Textarea
                            className="w-full h-96 font-mono text-sm"
                            readOnly
                            value={contractCode}
                        />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={onPrevious}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                        onClick={onDeploy}
                        disabled={isDeploying}
                        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            <>
                                Deploy Contract
                                <Globe className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default PreviewStep; 