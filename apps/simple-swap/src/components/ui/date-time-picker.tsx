"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Calendar, Clock } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './select';

interface DateTimePickerProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export default function DateTimePicker({
    value,
    onChange,
    placeholder = "Select date and time",
    className = ""
}: DateTimePickerProps) {
    const [open, setOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedHour, setSelectedHour] = useState<string>('12');
    const [selectedMinute, setSelectedMinute] = useState<string>('00');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('PM');

    // Parse the input value when it changes
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setSelectedDate(date);
                const hours = date.getHours();
                const minutes = date.getMinutes();

                // Convert to 12-hour format
                const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
                const period = hours >= 12 ? 'PM' : 'AM';

                setSelectedHour(hour12.toString().padStart(2, '0'));
                setSelectedMinute(minutes.toString().padStart(2, '0'));
                setSelectedPeriod(period);
            }
        }
    }, [value]);

    // Generate date options (next 30 days)
    const generateDateOptions = () => {
        const options = [];
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            options.push(date);
        }

        return options;
    };

    // Generate hour options (1-12)
    const generateHourOptions = () => {
        return Array.from({ length: 12 }, (_, i) => {
            const hour = i + 1;
            return hour.toString().padStart(2, '0');
        });
    };

    // Generate minute options (00, 15, 30, 45)
    const generateMinuteOptions = () => {
        return ['00', '15', '30', '45'];
    };

    const formatDisplayValue = () => {
        if (!selectedDate) return placeholder;

        const dateStr = selectedDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `${dateStr} at ${selectedHour}:${selectedMinute} ${selectedPeriod}`;
    };

    const handleConfirm = () => {
        if (!selectedDate) return;

        // Convert to 24-hour format
        let hour24 = parseInt(selectedHour);
        if (selectedPeriod === 'PM' && hour24 !== 12) {
            hour24 += 12;
        } else if (selectedPeriod === 'AM' && hour24 === 12) {
            hour24 = 0;
        }

        // Create the datetime string
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = selectedDate.getDate().toString().padStart(2, '0');
        const hour = hour24.toString().padStart(2, '0');
        const minute = selectedMinute;

        const datetimeString = `${year}-${month}-${day}T${hour}:${minute}`;
        onChange(datetimeString);
        setOpen(false);
    };

    const handleClear = () => {
        setSelectedDate(null);
        setSelectedHour('12');
        setSelectedMinute('00');
        setSelectedPeriod('PM');
        onChange('');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${className}`}
                >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formatDisplayValue()}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Schedule Start Time
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Date Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Date</label>
                        <Select
                            value={selectedDate?.toDateString() || ''}
                            onValueChange={(value: string) => {
                                const date = new Date(value);
                                setSelectedDate(date);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a date" />
                            </SelectTrigger>
                            <SelectContent>
                                {generateDateOptions().map((date) => (
                                    <SelectItem key={date.toDateString()} value={date.toDateString()}>
                                        {date.toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Time Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Time</label>
                        <div className="grid grid-cols-3 gap-2">
                            {/* Hour */}
                            <Select value={selectedHour} onValueChange={setSelectedHour}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {generateHourOptions().map((hour) => (
                                        <SelectItem key={hour} value={hour}>
                                            {hour}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Minute */}
                            <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {generateMinuteOptions().map((minute) => (
                                        <SelectItem key={minute} value={minute}>
                                            {minute}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* AM/PM */}
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AM">AM</SelectItem>
                                    <SelectItem value="PM">PM</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={handleClear}
                            className="flex-1"
                        >
                            Clear
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedDate}
                            className="flex-1"
                        >
                            Confirm
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
} 