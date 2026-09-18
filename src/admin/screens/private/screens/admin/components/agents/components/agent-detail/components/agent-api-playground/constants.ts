import type { Content } from 'vanilla-jsoneditor';

import type { SelectSuggestionItem } from '@/components/ui/select';

export const INPUT_TYPES_DEFAULT_VALUE = {
    text: '',
    textbox: '',
    number: '0',
    radio: '',
    checkbox: [],
    select: { label: '', value: '' } as SelectSuggestionItem<string>,
    multiselect: [],
    filesupload: [],
    jsoneditor: { json: {} } as Content,
};
