import React from 'react';

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-20">
    <Icon className="w-20 h-20 mx-auto text-gray-600 mb-4" />
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-gray-400 mb-6">{description}</p>
    {action}
  </div>
);

export default EmptyState;
