-- Add C, C++ and C# starter templates to the reviewed coding library.
-- The original seed migration uses ON CONFLICT DO NOTHING, so this follow-up
-- also updates problems that already exist in deployed projects.
UPDATE public.coding_problems
SET starter_code = starter_code || CASE slug
  WHEN 'two-sum' THEN '{"c":"#include <stdlib.h>\n\nint* two_sum(int* nums, int numsSize, int target, int* returnSize) {\n    *returnSize = 0;\n    return NULL;\n}","cpp":"#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    return {};\n}","csharp":"using System.Collections.Generic;\n\npublic class Solution {\n    public int[] TwoSum(int[] nums, int target) {\n        return new int[0];\n    }\n}"}'::jsonb
  WHEN 'valid-parentheses' THEN '{"c":"#include <stdbool.h>\n\nbool is_valid(const char* s) {\n    return false;\n}","cpp":"#include <string>\nusing namespace std;\n\nbool isValid(string s) {\n    return false;\n}","csharp":"public class Solution {\n    public bool IsValid(string s) {\n        return false;\n    }\n}"}'::jsonb
  WHEN 'binary-search' THEN '{"c":"int search(int* nums, int numsSize, int target) {\n    return -1;\n}","cpp":"#include <vector>\nusing namespace std;\n\nint search(vector<int>& nums, int target) {\n    return -1;\n}","csharp":"public class Solution {\n    public int Search(int[] nums, int target) {\n        return -1;\n    }\n}"}'::jsonb
  ELSE '{}'::jsonb
END
WHERE slug IN ('two-sum', 'valid-parentheses', 'binary-search');
