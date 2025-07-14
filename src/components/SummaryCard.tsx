// components/SummaryCard.tsx
import { translateToUrdu } from '@/lib/translator';

interface Props {
  summary: string;
}

export default function SummaryCard({ summary }: Props) {
  const urduTranslation = translateToUrdu(summary);

  return (
    <div className="grid md:grid-cols-2 gap-6 p-4 rounded-xl shadow bg-white">
      <div className="border-r pr-4">
        <h2 className="text-lg font-semibold mb-2">📝 English Summary</h2>
        <p className="text-gray-800">{summary}</p>
      </div>
      <div className="pl-4">
        <h2 className="text-lg font-semibold mb-2">📖 اردو ترجمہ</h2>
        <p className="text-gray-900 urdu-text leading-loose">{urduTranslation}</p>
      </div>
    </div>
  );
}
