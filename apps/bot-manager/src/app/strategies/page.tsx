'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, FileText, Zap } from 'lucide-react';

export default function StrategiesPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-background min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Strategy Templates</h1>
          <p className="text-muted-foreground mt-2">
            Browse and explore trading strategy examples for your bots
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              Blank Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Start from scratch with a minimal template
            </p>
            <Button variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              View Template
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Code className="w-5 h-5 text-green-400" />
              Yield Farming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Automated yield farming with compounding
            </p>
            <Button variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              View Template
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" />
              DCA Strategy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Dollar cost averaging with market timing
            </p>
            <Button variant="outline" className="w-full">
              <FileText className="w-4 h-4 mr-2" />
              View Template
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}