import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { setLockDuration } from '@/lib/admin-api';

interface LockDurationControlProps {
    status: any;
    onRefresh: () => void;
}

export function LockDurationControl({ status, onRefresh }: LockDurationControlProps) {
    const [durationMinutes, setDurationMinutes] = useState(5);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateDuration = async () => {
        setIsUpdating(true);
        try {
            const result = await setLockDuration(durationMinutes);
            if (result.error) {
                toast.error(`Failed to update lock duration: ${result.error}`);
            } else {
                toast.success(`Lock duration set to ${durationMinutes} minute(s)`);
                onRefresh();
            }
        } catch (error) {
            toast.error('Failed to update lock duration');
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        if (status?.lockDuration) {
            setDurationMinutes(Math.round(status.lockDuration.duration / 60000));
        }
    }, [status?.lockDuration]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Lock Duration</CardTitle>
                <CardDescription>Set how long betting should be locked before spin</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <Label htmlFor="lockDuration">Duration (minutes)</Label>
                        <Input
                            id="lockDuration"
                            type="number"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0.5)}
                            min="0.5"
                            step="0.5"
                        />
                    </div>
                    <Button
                        onClick={handleUpdateDuration}
                        disabled={isUpdating}
                        className="mb-0.5"
                    >
                        Update
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
} 