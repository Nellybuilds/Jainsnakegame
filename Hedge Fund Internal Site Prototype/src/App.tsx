import { useState } from 'react';
import { CategoryNav } from './components/CategoryNav';
import { ToolCard } from './components/ToolCard';
import { EasterEgg } from './components/EasterEgg';
import { Input } from './components/ui/input';
import { DOMSnakeGame } from './components/DOMSnakeGame';
import { Search } from 'lucide-react';
import './styles/game-transitions.css'; // Import the new CSS file

// Tool cards data
const tools = [
  {
    title: 'Market Monitor',
    description: 'Real-time market data and alerts',
    imageUrl: 'https://images.unsplash.com/photo-1666467831470-8f26f983391f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9jayUyMG1hcmtldCUyMHRyYWRpbmd8ZW58MXx8fHwxNzYwMzc4MzM4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Live',
  },
  {
    title: 'Portfolio Analytics',
    description: 'Deep dive into portfolio metrics',
    imageUrl: 'https://images.unsplash.com/photo-1726653024714-42857c1b4906?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0Zm9saW8lMjBpbnZlc3RtZW50fGVufDF8fHx8MTc2MDQwMTY1MHww&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Risk Dashboard',
    description: 'Monitor exposure and risk factors',
    imageUrl: 'https://images.unsplash.com/photo-1644093387522-b1be6de270a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXNrJTIwbWFuYWdlbWVudCUyMGZpbmFuY2lhbHxlbnwxfHx8fDE3NjA0MDE2NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Critical',
  },
  {
    title: 'Alpha Generator',
    description: 'Build and test trading strategies',
    imageUrl: 'https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGFuYWx5dGljcyUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjAzODYwMDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Stock Screener',
    description: 'Advanced equity screening tools',
    imageUrl: 'https://images.unsplash.com/photo-1744782211816-c5224434614f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBjaGFydHMlMjBkYXRhfGVufDF8fHx8MTc2MDM3NzUwN3ww&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Trade Execution',
    description: 'Algorithmic order management',
    imageUrl: 'https://images.unsplash.com/photo-1623715537851-8bc15aa8c145?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwb2ZmaWNlJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2MDM1MzEyNnww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'Fast',
  },
  {
    title: 'Backtester Pro',
    description: 'Historical strategy simulation',
    imageUrl: 'https://images.unsplash.com/photo-1666467831470-8f26f983391f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9jayUyMG1hcmtldCUyMHRyYWRpbmd8ZW58MXx8fHwxNzYwMzc4MzM4fDA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Factor Analysis',
    description: 'Multi-factor decomposition',
    imageUrl: 'https://images.unsplash.com/photo-1744782211816-c5224434614f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBjaGFydHMlMjBkYXRhfGVufDF8fHx8MTc2MDM3NzUwN3ww&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Sentiment Tracker',
    description: 'Market sentiment analysis',
    imageUrl: 'https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGFuYWx5dGljcyUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjAzODYwMDB8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'VaR Calculator',
    description: 'Value at risk modeling',
    imageUrl: 'https://images.unsplash.com/photo-1644093387522-b1be6de270a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXNrJTIwbWFuYWdlbWVudCUyMGZpbmFuY2lhbHxlbnwxfHx8fDE3NjA0MDE2NTB8MA&ixlib=rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Idea Pipeline',
    description: 'Investment research workflow',
    imageUrl: 'https://images.unsplash.com/photo-1726653024714-42857c1b4906?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3J0Zm9saW8lMjBpbnZlc3RtZW50fGVufDF8fHx8MTc2MDQwMTY1MHww&ixlib=rb-4.1.0&q=80&w=1080',
    badge: 'New',
  },
  {
    title: 'Performance Report',
    description: 'Returns and attribution',
    imageUrl: 'https://images.unsplash.com/photo-1623715537851-8bc15aa8c145?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0ZWNobm9sb2d5JTIwb2ZmaWNlJTIwd29ya3NwYWNlfGVufDF8fHx8MTc2MDM1MzEyNnww&ixlib.rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Signal Lab',
    description: 'Custom signals builder',
    imageUrl: 'https://images.unsplash.com/photo-1666467831470-8f26f983391f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdG9jayUyMG1hcmtldCUyMHRyYWRpbmd8ZW58MXx8fHwxNzYwMzc4MzM4fDA&ixlib.rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Stress Testing',
    description: 'Scenario analysis tools',
    imageUrl: 'https://images.unsplash.com/photo-1744782211816-c5224434614f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBjaGFydHMlMjBkYXRhfGVufDF8fHx8MTc2MDM3NzUwN3ww&ixlib.rb-4.1.0&q=80&w=1080',
  },
  {
    title: 'Order Flow Analytics',
    description: 'Market microstructure analysis',
    imageUrl: 'https://images.unsplash.com/photo-1608222351212-18fe0ec7b13b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGFuYWx5dGljcyUyMGRhc2hib2FyZHxlbnwxfHx8fDE3NjAzODYwMDB8MA&ixlib.rb-4.1.0&q=80&w=1080',
  },
];

const topRowTools = tools.slice(0, 10);
const bottomRowTools = tools.slice(10);

export default function App() {
  const [searchValue, setSearchValue] = useState('');
  const [isGameOpen, setIsGameOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    
    if (value.toLowerCase() === 'hiss') {
      setIsGameOpen(true);
      setSearchValue('');
    }
  };

  return (
    <div className={`min-h-screen bg-background ${isGameOpen ? 'game-open' : ''}`}>
      <div className="game-overlay"></div>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-6">
            <h1 className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
              Hedge Fund Internal Portal
            </h1>
            
            {/* Search Bar */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search tools..."
                value={searchValue}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Category Navigation */}
      <CategoryNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tools Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2>Internal Tools & Applications</h2>
              <p className="text-muted-foreground">Access your trading, research, and analytics tools</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {topRowTools.map((tool) => (
              <ToolCard
                key={tool.title}
                title={tool.title}
                description={tool.description}
                imageUrl={tool.imageUrl}
                badge={tool.badge}
                onClick={() => console.log(`Opening ${tool.title}`)}
              />
            ))}
          </div>
          <div className="bottom-row">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-6">
              {bottomRowTools.map((tool) => (
                <ToolCard
                  key={tool.title}
                  title={tool.title}
                  description={tool.description}
                  imageUrl={tool.imageUrl}
                  badge={tool.badge}
                  onClick={() => console.log(`Opening ${tool.title}`)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground py-8 border-t">
          <p>Internal Use Only • Built for Buy-Side Professionals</p>
        </footer>
      </main>

      {/* Easter Eggs */}
      <EasterEgg />

      {/* DOM Snake Game Overlay */}
      {isGameOpen && (
        <div className="snake-game-container">
          <DOMSnakeGame onClose={() => setIsGameOpen(false)} />
        </div>
      )}
    </div>
  );
}
