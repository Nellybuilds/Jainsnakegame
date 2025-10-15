import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ToolCardProps {
  title: string;
  description: string;
  imageUrl: string;
  badge?: string;
  onClick?: () => void;
}

export function ToolCard({ title, description, imageUrl, badge, onClick }: ToolCardProps) {
  return (
    <Card 
      className="gamify-card group overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden bg-muted">
          <ImageWithFallback
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {badge && (
            <Badge className="absolute top-2 right-2 bg-primary/90 backdrop-blur-sm">
              {badge}
            </Badge>
          )}
        </div>
        <div className="p-4">
          <h3 className="mb-1">{title}</h3>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
