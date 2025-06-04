-- Create a function to execute workflows
CREATE OR REPLACE FUNCTION execute_workflows()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  workflow_record RECORD;
  step_record RECORD;
  executed_count INTEGER := 0;
  next_step_delay INTERVAL;
  result json;
BEGIN
  -- Find debtor workflows that need action
  FOR workflow_record IN
    SELECT dw.*, d.name as debtor_name, d.email as debtor_email, 
           d.balance_cents, d.state, w.name as workflow_name
    FROM debtor_workflows dw
    JOIN debtors d ON d.id = dw.debtor_id
    JOIN workflows w ON w.id = dw.workflow_id
    WHERE dw.status = 'active' 
    AND dw.next_action_at <= NOW()
  LOOP
    -- Get the current workflow step
    SELECT * INTO step_record
    FROM workflow_steps 
    WHERE workflow_id = workflow_record.workflow_id 
    AND step_number = workflow_record.current_step_number;
    
    IF FOUND THEN
      -- Execute the step (create letter record)
      INSERT INTO letters (
        debtor_id, 
        template_id,
        status,
        sent_at,
        channel
      ) VALUES (
        workflow_record.debtor_id,
        step_record.template_id,
        'pending',  -- Will be updated by the API
        NOW(),
        'email'
      );
      
      -- Record the execution
      INSERT INTO workflow_executions (
        debtor_workflow_id,
        workflow_step_id,
        step_number,
        status,
        scheduled_at,
        executed_at
      ) VALUES (
        workflow_record.id,
        step_record.id,
        step_record.step_number,
        'completed',
        workflow_record.next_action_at,
        NOW()
      );
      
      executed_count := executed_count + 1;
      
      -- Check if there's a next step
      SELECT delay_days, delay_hours INTO next_step_delay
      FROM workflow_steps 
      WHERE workflow_id = workflow_record.workflow_id 
      AND step_number = workflow_record.current_step_number + 1;
      
      IF FOUND THEN
        -- Move to next step
        UPDATE debtor_workflows
        SET current_step_number = current_step_number + 1,
            next_action_at = NOW() + (next_step_delay::text || ' days')::interval
        WHERE id = workflow_record.id;
      ELSE
        -- Complete the workflow
        UPDATE debtor_workflows
        SET status = 'completed',
            completed_at = NOW(),
            next_action_at = NULL
        WHERE id = workflow_record.id;
      END IF;
    ELSE
      -- No more steps, complete workflow
      UPDATE debtor_workflows
      SET status = 'completed',
          completed_at = NOW(),
          next_action_at = NULL
      WHERE id = workflow_record.id;
    END IF;
  END LOOP;
  
  -- Call the API to send actual emails
  PERFORM net.http_post(
    url := current_setting('app.api_url', true) || '/api/execute-workflows',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  
  result := json_build_object(
    'success', true,
    'executed', executed_count,
    'message', 'Executed ' || executed_count || ' workflow steps'
  );
  
  RETURN result;
END;
$$; 