import { TabBar } from './TabBar';
import Editor, { EditorProps } from '@monaco-editor/react';
import React, { useState, useEffect } from 'react';
import { JudgeSuccessResult } from '../types/judge';

export interface OutputProps {
  result: JudgeSuccessResult | null;
  onMount: EditorProps['onMount'];
}

type OutputTab = 'stdout' | 'stderr' | 'compile_output' | 'message';

const tabs = [
  { label: 'stdout', value: 'stdout' },
  { label: 'stderr', value: 'stderr' },
  { label: 'compile output', value: 'compile_output' },
  { label: 'sandbox message', value: 'message' },
];

export const Output = ({ result, onMount }: OutputProps): JSX.Element => {
  // todo make this type better...
  const [option, setOption] = useState<OutputTab>('stdout');

  useEffect(() => {
    const option = tabs.find(tab => result?.[tab.value as OutputTab])?.value;
    if (option) setOption(option as OutputTab);
  }, [result]);

  return (
    <>
      <TabBar
        tabs={tabs}
        activeTab={option}
        onTabSelect={tab => {
          setOption(tab.value as OutputTab);
        }}
      />
      <div className="flex-1 bg-[#1E1E1E] text-white min-h-0 overflow-hidden tw-forms-disable tw-forms-disable-all-descendants">
        <Editor
          theme="vs-dark"
          language={'plaintext'}
          value={result?.[option] ?? ''}
          saveViewState={false}
          path="output"
          options={{
            minimap: { enabled: false },
            readOnly: true,
            automaticLayout: false,
            insertSpaces: false,
          }}
          onMount={onMount}
        />
      </div>
      <div className="text-sm font-mono text-right pr-4 text-gray-200">
        {result && (
          <>
            {result.status.description}, {result.time ?? '-'}s,{' '}
            {result.memory ?? '-'}KB
          </>
        )}
      </div>
    </>
  );
};
