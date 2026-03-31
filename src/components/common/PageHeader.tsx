interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between bg-[#0E2137] rounded-xl px-5 py-3 shadow-md">
      <div>
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        <p className="text-slate-400 mt-0.5 text-xs">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
