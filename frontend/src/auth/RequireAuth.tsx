import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "@civic/auth-web3/react";

const RequireAuth: React.FC = () => {
    const { user, status } = useUser() as {user: unknown | null; status?: "idle"|"loading"|"authenticated"|"error"};
    const location = useLocation();

    if (status === "loading") {
        return <div className="p-6 text-center text-gray-600">Checking session...</div>
    }

    if (!user) {
        return <Navigate to="/" replace state={{ from: location }} />
    }

    return <Outlet />;
}

export default RequireAuth;