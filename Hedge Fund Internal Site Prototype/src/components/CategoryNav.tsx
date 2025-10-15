import { useState } from 'react';
import { 
  TrendingUp, 
  Search, 
  Briefcase, 
  ShieldAlert, 
  BarChart3,
  ChevronDown 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';

interface AppTile {
  name: string;
  description: string;
}

interface Category {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  apps: AppTile[];
}

const categories: Category[] = [
  {
    name: 'Trading',
    icon: TrendingUp,
    apps: [
      { name: 'Market Monitor', description: 'Real-time market data' },
      { name: 'Live Execution', description: 'Order management system' },
      { name: 'Order Flow', description: 'Flow analysis tools' },
      { name: 'Market Maker', description: 'MM analytics dashboard' },
    ],
  },
  {
    name: 'Research',
    icon: Search,
    apps: [
      { name: 'Idea Tracker', description: 'Investment ideas pipeline' },
      { name: 'Stock Screener', description: 'Advanced screening tools' },
      { name: 'Earnings Calendar', description: 'Upcoming earnings events' },
      { name: 'Thesis Builder', description: 'Document investment theses' },
      { name: 'Sentiment Analysis', description: 'Market sentiment tracker' },
    ],
  },
  {
    name: 'Portfolio',
    icon: Briefcase,
    apps: [
      { name: 'Holdings View', description: 'Current portfolio positions' },
      { name: 'Attribution Analysis', description: 'Performance attribution' },
      { name: 'Rebalancer', description: 'Portfolio optimization' },
      { name: 'Performance Report', description: 'Returns & metrics' },
    ],
  },
  {
    name: 'Risk',
    icon: ShieldAlert,
    apps: [
      { name: 'Risk Dashboard', description: 'Real-time risk metrics' },
      { name: 'VaR Calculator', description: 'Value at risk analysis' },
      { name: 'Stress Testing', description: 'Scenario modeling' },
      { name: 'Exposure Monitor', description: 'Factor & sector exposure' },
    ],
  },
  {
    name: 'Analytics',
    icon: BarChart3,
    apps: [
      { name: 'Alpha Generator', description: 'Strategy development' },
      { name: 'Factor Analysis', description: 'Factor decomposition' },
      { name: 'Backtester', description: 'Historical simulation' },
      { name: 'Signal Lab', description: 'Custom signals builder' },
    ],
  },
];

export function CategoryNav() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-1">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <DropdownMenu
                  key={category.name}
                  onOpenChange={(open) =>
                    setActiveCategory(open ? category.name : null)
                  }
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={
                        activeCategory === category.name ? 'secondary' : 'ghost'
                      }
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {category.name}
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {category.apps.map((app) => (
                      <DropdownMenuItem
                        key={app.name}
                        className="flex flex-col items-start py-3 cursor-pointer"
                      >
                        <div className="font-medium">{app.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {app.description}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
