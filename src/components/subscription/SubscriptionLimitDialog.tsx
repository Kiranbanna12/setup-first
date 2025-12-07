
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SubscriptionLimitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description: string;
}

export function SubscriptionLimitDialog({
    open,
    onOpenChange,
    title = "Upgrade Plan Required",
    description
}: SubscriptionLimitDialogProps) {
    const navigate = useNavigate();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Crown className="w-6 h-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl">{title}</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="w-full sm:w-auto"
                    >
                        Maybe Later
                    </Button>
                    <Button
                        onClick={() => {
                            onOpenChange(false);
                            navigate("/pricing"); // Changed from subscription-management to pricing for new app structure
                        }}
                        className="w-full sm:w-auto gradient-primary gap-2"
                    >
                        <Crown className="w-4 h-4" />
                        View Upgrade Options
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
