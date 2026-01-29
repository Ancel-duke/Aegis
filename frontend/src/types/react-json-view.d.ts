declare module 'react-json-view' {
  import { Component } from 'react';

  export interface ReactJsonViewProps {
    src: object;
    theme?: string | object;
    name?: string | false;
    iconStyle?: string;
    collapsed?: boolean | number;
    collapseStringsAfterLength?: number;
    groupArraysAfterLength?: number;
    enableClipboard?: boolean | ((copy: { src: object }) => void);
    displayDataTypes?: boolean;
    displayObjectSize?: boolean;
    onEdit?: (edit: { new_value: unknown; existing_value: unknown; name: string }) => boolean | void;
    onAdd?: (add: { new_value: unknown; name: string }) => boolean | void;
    onDelete?: (del: { existing_value: unknown; name: string }) => boolean | void;
    onSelect?: (select: { name: string; value: unknown; type: string }) => void;
    style?: object;
    [key: string]: unknown;
  }

  export default class ReactJsonView extends Component<ReactJsonViewProps> {}
}
