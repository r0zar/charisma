"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Share2, Copy, Check } from "lucide-react";
import { toast } from 'sonner';

interface SocialShareProps {
    offerUrl: string;
    offerTitle?: string; // Optional title for sharing
}

export default function SocialShare({ offerUrl, offerTitle = "Check out this offer:" }: SocialShareProps) {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(offerUrl).then(() => {
            setCopied(true);
            toast.success("Link copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            toast.error("Failed to copy link.");
            console.error('Failed to copy: ', err);
        });
    };

    const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(offerUrl)}&text=${encodeURIComponent(offerTitle)}`;
    // Add more social media URLs as needed
    // const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(offerUrl)}`;
    // const linkedInShareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(offerUrl)}&title=${encodeURIComponent(offerTitle)}`;


    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Share2 className="h-5 w-5 mr-2" />
                    Share this Offer
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex space-x-2">
                    <Input type="text" value={offerUrl} readOnly className="flex-grow" />
                    <Button variant="outline" onClick={handleCopyLink} size="icon" aria-label="Copy link">
                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" asChild>
                        <a href={twitterShareUrl} target="_blank" rel="noopener noreferrer">
                            Share on X (Twitter)
                        </a>
                    </Button>
                    {/* Add more buttons here, e.g., Facebook, LinkedIn */}
                </div>
            </CardContent>
        </Card>
    );
} 