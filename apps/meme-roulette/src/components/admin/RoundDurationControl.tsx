import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { setRoundDuration } from '@/lib/admin-api';

interface RoundDurationControlProps {
    status: any;
    onRefresh: () => void;
}

export function RoundDurationControl({ status, onRefresh }: RoundDurationControlProps) {
    const [durationMinutes, setDurationMinutes] = useState(5);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleUpdateDuration = async () => {
        setIsUpdating(true);
        try {
            const result = await setRoundDuration(durationMinutes);
            if (result.error) {
                toast.error(`Failed to update duration: ${result.error}`);
            } else {
                toast.success(`Round duration set to ${durationMinutes} minute(s)`);
                onRefresh();
            }
        } catch (error) {
            toast.error('Failed to update round duration');
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        if (status?.roundDuration) {
            setDurationMinutes(Math.round(status.roundDuration.duration / 60000));
        }
    }, [status?.roundDuration]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Round Duration</CardTitle>
                <CardDescription>Set how long each round should last</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-end gap-3">
                    <div className="flex-1">
                        <Label htmlFor="roundDuration">Duration (minutes)</Label>
                        <Input
                            id="roundDuration"
                            type="number"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 1)}
                            min="1"
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