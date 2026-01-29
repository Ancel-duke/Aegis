import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

describe('UI Components', () => {
  describe('Button', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should handle click', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      render(<Button onClick={handleClick}>Click</Button>);
      
      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input', () => {
    it('should render input with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it('should display error message', () => {
      render(<Input error="Invalid input" />);
      expect(screen.getByText(/invalid input/i)).toBeInTheDocument();
    });

    it('should handle input change', async () => {
      const user = userEvent.setup();
      render(<Input label="Test" />);
      const input = screen.getByLabelText(/test/i);
      
      await user.type(input, 'test value');
      expect(input).toHaveValue('test value');
    });
  });

  describe('Badge', () => {
    it('should render badge with text', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText(/test badge/i)).toBeInTheDocument();
    });

    it('should apply variant styles', () => {
      const { container } = render(<Badge variant="success">Success</Badge>);
      expect(container.firstChild).toHaveClass('bg-green-500');
    });
  });

  describe('Card', () => {
    it('should render card with content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>Card content</CardContent>
        </Card>
      );
      expect(screen.getByText(/test card/i)).toBeInTheDocument();
      expect(screen.getByText(/card content/i)).toBeInTheDocument();
    });
  });

  describe('Skeleton', () => {
    it('should render skeleton', () => {
      const { container } = render(<Skeleton className="h-4 w-20" />);
      expect(container.firstChild).toHaveClass('animate-pulse');
    });
  });
});
