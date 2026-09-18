import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { Accounts } from './screens';

const Public = () => {
    const navigate = useNavigate();

    useEffect(() => {
        if (location.pathname === '/') {
            navigate('/accounts');
        }
    }, []);

    return (
        <Routes>
            <Route path="accounts/*" element={<Accounts />} />
            <Route path="*" element={<Navigate to="/accounts" />} />
        </Routes>
    );
};

export default Public;
