'use client';
import { useState } from 'react';
import BlockRenderer from '@/components/BlockRenderer';

const initialTree = {
  type: 'page',
  children: [
    { type: 'section', props: { py: 80 }, children: [
      { type: 'container', props: { maxW: 960 }, children: [
        { type: 'heading', props: { level: 1, text: 'Seu título forte' } },
        { type: 'text', props: { html: 'Subtítulo persuasivo.' } },
        { type: 'button', props: { text: 'Começar', href: '#' } }
      ]}
    ]}
  ]
};

export default function Editor() {
  const [tree, setTree] = useState<any>(initialTree);

  const publish = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: '00000000-0000-0000-0000-000000000000', // placeholder
        path: '/',
        title: 'Home',
        tree
      })
    });
    alert('Publicação (demo): ' + res.status);
  };

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Editor (demo)</h1>
      <div className="my-4 border rounded-lg p-4">
        <BlockRenderer node={tree} />
      </div>
      <button className="rounded-lg border px-4 py-2" onClick={publish}>Publicar (demo)</button>
    </main>
  );
}
