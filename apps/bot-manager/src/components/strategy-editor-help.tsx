'use client';

import { 
  AlertCircle, 
  Code, 
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Search, 
  Settings} from 'lucide-react';
import React, { useMemo,useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { helpContent } from '@/lib/help/content';
import type { 
  HelpContextualInfo, 
  HelpSection} from '@/lib/help/types';

import { CodeExample as CodeExampleComponent } from './code-example';

interface StrategyEditorHelpProps {
  isOpen: boolean;
  onClose: () => void;
  contextualInfo?: HelpContextualInfo;
}

export function StrategyEditorHelp({ 
  isOpen, 
  onClose,
  contextualInfo 
}: StrategyEditorHelpProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('getting-started');
  const [copiedExamples, setCopiedExamples] = useState<Set<string>>(new Set());

  // Filter content based on search query
  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return helpContent;

    const query = searchQuery.toLowerCase();
    const filteredTabs = helpContent.tabs.map(tab => ({
      ...tab,
      sections: tab.sections.filter(section => 
        section.title.toLowerCase().includes(query) ||
        section.content.toLowerCase().includes(query) ||
        section.searchTerms.some(term => term.toLowerCase().includes(query)) ||
        section.examples.some(example => 
          example.title.toLowerCase().includes(query) ||
          example.description.toLowerCase().includes(query)
        )
      )
    })).filter(tab => tab.sections.length > 0);

    const filteredTroubleshooting = helpContent.troubleshooting.filter(item =>
      item.problem.toLowerCase().includes(query) ||
      item.solution.toLowerCase().includes(query)
    );

    return {
      ...helpContent,
      tabs: filteredTabs,
      troubleshooting: filteredTroubleshooting
    };
  }, [searchQuery]);

  const handleCopyExample = async (exampleId: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedExamples(prev => new Set(Array.from(prev).concat([exampleId])));
      setTimeout(() => {
        setCopiedExamples(prev => {
          const next = new Set(prev);
          next.delete(exampleId);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const renderSection = (section: HelpSection) => (
    <div key={section.id} className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {section.title}
        </h3>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {section.content.split('\n\n').map((paragraph, index) => (
            <p key={index} className="text-muted-foreground leading-relaxed">
              {paragraph.split('**').map((part, i) => 
                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
              )}
            </p>
          ))}
        </div>
      </div>

      {section.examples.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Code className="h-4 w-4" />
            Examples
          </h4>
          {section.examples.map(example => (
            <CodeExampleComponent
              key={example.id}
              example={example}
              onCopy={handleCopyExample}
              isCopied={copiedExamples.has(example.id)}
            />
          ))}
        </div>
      )}

      {section.links.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Related Links
          </h4>
          {section.links.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <ExternalLink className="h-3 w-3" />
              {link.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const renderTroubleshooting = () => (
    <div className="space-y-4">
      {filteredContent.troubleshooting.map(item => (
        <div key={item.id} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <h4 className="font-medium text-foreground">{item.problem}</h4>
              <p className="text-sm text-muted-foreground">{item.solution}</p>
            </div>
          </div>
          
          {item.code && (
            <CodeExampleComponent
              example={{
                id: `troubleshoot-${item.id}`,
                title: 'Solution Code',
                description: 'Example code to resolve this issue',
                code: item.code,
                language: 'javascript',
                copyable: true
              }}
              onCopy={handleCopyExample}
              isCopied={copiedExamples.has(`troubleshoot-${item.id}`)}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="h-[90vh] !max-h-[90vh] !mt-4 flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Strategy Editor Help
          </DrawerTitle>
          <DrawerDescription>
            Learn how to write effective bot strategies with direct imports and package management.
          </DrawerDescription>
        </DrawerHeader>

        {/* Search */}
        <div className="relative px-4">
          <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search help content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Contextual Info */}
        {contextualInfo?.currentRepository && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 mx-4">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Current Repository Configuration
            </h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Git URL:</strong> {contextualInfo.currentRepository.gitUrl || 'Not configured'}</p>
              {contextualInfo.currentRepository.subPath && (
                <p><strong>Subpath:</strong> {contextualInfo.currentRepository.subPath}</p>
              )}
              {contextualInfo.currentRepository.availablePackages && (
                <div>
                  <strong>Available Packages:</strong>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contextualInfo.currentRepository.availablePackages.map(pkg => (
                      <Badge key={pkg} variant="secondary" className="text-xs">
                        {pkg}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-h-0 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4 h-auto">
              {filteredContent.tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm p-2 sm:p-3">
                  {tab.icon && <span className="text-sm sm:text-base">{tab.icon}</span>}
                  <span className="hidden xs:inline sm:inline">{tab.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {filteredContent.tabs.map(tab => (
              <TabsContent key={tab.id} value={tab.id} className="flex-1 min-h-0">
                <div className="h-full overflow-y-auto">
                  <div className="space-y-6 pr-4 pb-4">
                    {tab.sections.map(section => (
                      <div key={section.id}>
                        {renderSection(section)}
                        <div className="border-t border-border my-6" />
                      </div>
                    ))}
                    
                    {tab.id === 'troubleshooting' && renderTroubleshooting()}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>
              {searchQuery 
                ? `Found ${filteredContent.tabs.reduce((acc, tab) => acc + tab.sections.length, 0)} sections`
                : 'Use search to find specific topics quickly'
              }
            </span>
          </div>
          
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}