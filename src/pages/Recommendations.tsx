import { Navigate, useParams } from 'react-router-dom';
export function Recommendations() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?tab=recommendations`} replace />;
}
