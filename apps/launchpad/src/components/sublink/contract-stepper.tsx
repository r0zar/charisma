import { Check } from "lucide-react";

interface ContractStepperProps {
    currentStep: number;
}

const ContractStepper = ({ currentStep }: ContractStepperProps) => {
    return (
        <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > 0 ? <Check className="h-5 w-5" /> : "1"}
                </div>
                <span className="text-xs mt-2">Select Token</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= 1 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > 1 ? <Check className="h-5 w-5" /> : "2"}
                </div>
                <span className="text-xs mt-2">Select Subnet Token</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= 2 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > 2 ? <Check className="h-5 w-5" /> : "3"}
                </div>
                <span className="text-xs mt-2">Preview</span>
            </div>
            <div className="h-[2px] flex-1 bg-muted mx-2" />
            <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 
                    ${currentStep >= 3 ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-muted/50 text-muted-foreground'}`}>
                    {currentStep > 3 ? <Check className="h-5 w-5" /> : "4"}
                </div>
                <span className="text-xs mt-2">Deploy</span>
            </div>
        </div>
    );
};

export default ContractStepper; 