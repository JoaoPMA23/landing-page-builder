export default function BlockRenderer({ node }: { node: any }) {
  const children = (node.children || []).map((c: any, i: number) => <BlockRenderer key={i} node={c} />);
  switch (node.type) {
    case 'page': return <>{children}</>;
    case 'section': return <section className={`py-${(node.props?.py ?? 60)/4}`}>{children}</section>;
    case 'container': return <div className="mx-auto px-6" style={{ maxWidth: node.props?.maxW || 1140 }}>{children}</div>;
    case 'heading': {
      const Tag = `h${node.props?.level || 2}` as any;
      return <Tag className="text-3xl font-bold tracking-tight">{node.props?.text}</Tag>;
    }
    case 'text': return <div dangerouslySetInnerHTML={{ __html: node.props?.html || '' }} />;
    case 'button': return <a className="inline-block rounded-lg px-4 py-2 border shadow-sm" href={node.props?.href || '#'}>{node.props?.text || 'Button'}</a>;
    default: return null;
  }
}
