import { useState } from 'react';
import { DollarSign, Trophy } from 'lucide-react';
import { Badge } from './ui/badge';

export function EasterEgg() {
  const [found, setFound] = useState(false);

  return (
    <>
      {/* Hidden Dollar Sign Easter Egg */}
      <button
        onClick={() => setFound(true)}
        className="fixed bottom-4 left-4 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform opacity-30 hover:opacity-100"
        title="Easter Egg! 💰"
      >
        <DollarSign className="w-4 h-4" />
      </button>

      {/* Stock Picker Achievement Badge */}
      {found && (
        <div className="fixed bottom-16 left-4 animate-in slide-in-from-bottom-5">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white gap-1 py-2 px-3 shadow-lg">
            <Trophy className="w-4 h-4" />
            Stock Picker Pro
          </Badge>
        </div>
      )}
    </>
  );
}
