// Aspect ratio presets
export const ASPECT_RATIO_PRESETS: Array<{ value: string; label: string; ratio?: number }> = [
    { value: 'free', label: 'Free' },
    { value: '1:1', label: '1:1', ratio: 1 },
    { value: '9:16', label: '9:16', ratio: 9 / 16 },
    { value: '16:9', label: '16:9', ratio: 16 / 9 },
    { value: '10:16', label: '10:16', ratio: 10 / 16 },
    { value: '16:10', label: '16:10', ratio: 16 / 10 },
    { value: '2:3', label: '2:3', ratio: 2 / 3 },
    { value: '3:2', label: '3:2', ratio: 3 / 2 },
    { value: '3:4', label: '3:4', ratio: 3 / 4 },
    { value: '4:3', label: '4:3', ratio: 4 / 3 },
    { value: '4:5', label: '4:5', ratio: 4 / 5 },
    { value: '5:4', label: '5:4', ratio: 5 / 4 },
];
