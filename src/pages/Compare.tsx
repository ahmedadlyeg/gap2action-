import { Navigate, useParams } from 'react-router-dom';
export function Compare() {
  const { id } = useParams();
  return <Navigate to={`/events/${id}?tab=compare`} replace />;
}
