import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { truncateAddress } from "@/lib/utils/token-utils";
import { ExternalLink } from "lucide-react";

interface DeploymentSidebarProps {
    stxAddress: string | null | undefined;
    deploymentCost: string;
    standardName: string;
    standardLink: string;
    documentationLink: string;
}

export const DeploymentSidebar = ({
    stxAddress,
    deploymentCost,
    standardName,
    standardLink,
    documentationLink,
}: DeploymentSidebarProps) => {
    return (
        <Card className="sticky top-24">
            <CardHeader>
                <CardTitle>Deployment Information</CardTitle>
                <CardDescription>
                    Important details about your deployment
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <h3 className="font-medium mb-1">Deploying as</h3>
                    <p className="text-sm font-mono text-muted-foreground">
                        {stxAddress ? truncateAddress(stxAddress) : 'Connect wallet'}
                    </p>
                </div>

                <div>
                    <h3 className="font-medium mb-1">Network</h3>
                    <p className="text-sm text-muted-foreground">Stacks Mainnet</p>
                </div>

                <div>
                    <h3 className="font-medium mb-1">Standard</h3>
                    <p className="text-sm text-muted-foreground">{standardName}</p>
                </div>

                <div>
                    <h3 className="font-medium mb-1">Deployment Cost</h3>
                    <p className="text-sm text-muted-foreground">{deploymentCost}</p>
                </div>
            </CardContent>
            <CardFooter className="border-t pt-6 flex flex-col items-start">
                <h3 className="font-medium mb-2">Resources</h3>
                <ul className="space-y-2 w-full">
                    <li>
                        <a
                            href={standardLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm flex items-center text-primary hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> {standardName} Standard
                        </a>
                    </li>
                    <li>
                        <a
                            href={documentationLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm flex items-center text-primary hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Token Documentation
                        </a>
                    </li>
                    <li>
                        <a
                            href="https://discord.gg/charisma" // Consider making this a prop if it varies
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm flex items-center text-primary hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Community Support
                        </a>
                    </li>
                </ul>
            </CardFooter>
        </Card>
    );
}; 