interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between bg-slate-800 rounded-xl px-6 py-4 shadow-lg">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        <p className="text-slate-300 mt-0.5 text-sm">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
