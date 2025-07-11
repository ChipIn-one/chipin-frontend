import { useEffect, useRef, useState } from 'react';
import { Toast as RadixToast } from 'radix-ui';

const ToastDemo = () => {
    const [open, setOpen] = useState(false);
    const eventDateRef = useRef(new Date());
    const timerRef = useRef(0);

    useEffect(() => {
        return () => clearTimeout(timerRef.current);
    }, []);

    return (
        <RadixToast.Provider swipeDirection="right">
            <button
                className="Button large violet"
                onClick={() => {
                    setOpen(false);
                    window.clearTimeout(timerRef.current);
                    timerRef.current = window.setTimeout(() => {
                        eventDateRef.current = oneWeekAway(new Date());
                        setOpen(true);
                    }, 100);
                }}
            >
                Add to calendar
            </button>

            <RadixToast.Root className="ToastRoot" open={open} onOpenChange={setOpen}>
                <RadixToast.Title className="ToastTitle">Scheduled: Catch up</RadixToast.Title>
                <RadixToast.Description asChild>
                    <time
                        className="ToastDescription"
                        dateTime={eventDateRef.current.toISOString()}
                    >
                        {prettyDate(eventDateRef.current)}
                    </time>
                </RadixToast.Description>
                <RadixToast.Action className="ToastAction" asChild altText="Goto schedule to undo">
                    <button className="Button small green">Undo</button>
                </RadixToast.Action>
            </RadixToast.Root>
            <RadixToast.Viewport className="ToastViewport" />
        </RadixToast.Provider>
    );
};

function oneWeekAway(date) {
    const now = new Date();
    const inOneWeek = now.setDate(now.getDate() + 7);
    return new Date(inOneWeek);
}

function prettyDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
    }).format(date);
}

export default ToastDemo;
