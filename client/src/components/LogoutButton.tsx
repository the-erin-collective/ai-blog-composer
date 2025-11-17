import { Button } from './ui/button';
import { useAuth } from '../hooks/useAuth';

export function LogoutButton() {
  const { logout } = useAuth();

  return (
    <Button 
      variant="outline" 
      onClick={logout}
      className="ml-4"
    >
      Logout
    </Button>
  );
}
